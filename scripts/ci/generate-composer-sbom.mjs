import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [lockPath = 'composer.lock', manifestPath = 'composer.json', outputPath = 'artifacts/composer.cdx.json'] = process.argv.slice(2);
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const productionPackages = Array.isArray(lock.packages) ? lock.packages : [];
const developmentPackages = Array.isArray(lock['packages-dev']) ? lock['packages-dev'] : [];
const developmentNames = new Set(developmentPackages.map((dependency) => dependency.name));
const packages = [...productionPackages, ...developmentPackages];

const purlFor = (dependency) => `pkg:composer/${dependency.name}@${encodeURIComponent(dependency.version)}`;
const packageByName = new Map(packages.map((dependency) => [dependency.name, dependency]));
const rootRef = `urn:composer:${manifest.name ?? 'ragilaluminium'}`;

const asArray = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    return value === undefined || value === null ? [] : [value];
};

const componentFor = (dependency) => {
    const [group, ...nameParts] = dependency.name.split('/');
    const externalReferences = [];

    if (dependency.source?.url) {
        externalReferences.push({ type: 'vcs', url: dependency.source.url });
    }

    if (dependency.dist?.url) {
        externalReferences.push({ type: 'distribution', url: dependency.dist.url });
    }

    const component = {
        type: 'library',
        'bom-ref': purlFor(dependency),
        group: nameParts.length > 0 ? group : undefined,
        name: nameParts.length > 0 ? nameParts.join('/') : group,
        version: dependency.version,
        scope: developmentNames.has(dependency.name) ? 'optional' : 'required',
        purl: purlFor(dependency),
        licenses: asArray(dependency.license).map((license) => ({ license: { name: String(license) } })),
        externalReferences,
        properties: [
            { name: 'cdx:composer:package:type', value: dependency.type ?? 'library' },
        ],
    };

    if (/^[a-f0-9]{40}$/i.test(dependency.dist?.shasum ?? '')) {
        component.hashes = [{ alg: 'SHA-1', content: dependency.dist.shasum.toLowerCase() }];
    }

    return Object.fromEntries(Object.entries(component).filter(([, value]) => value !== undefined && (!Array.isArray(value) || value.length > 0)));
};

const dependencyRefs = (requirements = {}) => Object.keys(requirements)
    .filter((name) => packageByName.has(name))
    .map((name) => purlFor(packageByName.get(name)))
    .sort();

const rootRequirements = {
    ...(manifest.require ?? {}),
    ...(manifest['require-dev'] ?? {}),
};

const components = packages
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(componentFor);

const dependencies = [
    { ref: rootRef, dependsOn: dependencyRefs(rootRequirements) },
    ...packages.map((dependency) => ({
        ref: purlFor(dependency),
        dependsOn: dependencyRefs(dependency.require),
    })),
];

const knownRefs = new Set([rootRef, ...components.map((component) => component['bom-ref'])]);

for (const dependency of dependencies) {
    if (!knownRefs.has(dependency.ref) || dependency.dependsOn.some((ref) => !knownRefs.has(ref))) {
        throw new Error(`Composer SBOM contains an unknown dependency reference: ${dependency.ref}`);
    }
}

if (knownRefs.size !== components.length + 1) {
    throw new Error('Composer SBOM contains duplicate component references.');
}

const bom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
        component: {
            type: 'application',
            'bom-ref': rootRef,
            name: manifest.name ?? 'ragilaluminium',
            ...(manifest.version ? { version: manifest.version } : {}),
        },
    },
    components,
    dependencies,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(bom, null, 2)}\n`, 'utf8');
console.log(`Composer CycloneDX SBOM: ${components.length} components -> ${outputPath}`);
